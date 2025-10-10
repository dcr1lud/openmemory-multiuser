# api/app/mcp_server.py
# Updated to support metadata (category, tags, priority) with AI-focused continuity

import json
import logging
import asyncio
import time
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator, Dict, Any, List
from uuid import uuid4
import traceback
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Query, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth import get_or_create_user_with_api_key, validate_api_key
# Removed DEFAULT_APP_ID import - using "default" directly
from app.database import SessionLocal
from app.models import App, Memory, User
from app.utils.memory import get_memory_client

logger = logging.getLogger(__name__)

# Store active SSE sessions with their message queues
sse_sessions: Dict[str, Dict[str, Any]] = {}


def setup_mcp_server(app: FastAPI):
    """Setup MCP (Model Context Protocol) server endpoints with proper SSE transport"""
    
    @app.get("/mcp/{client}/sse")
    async def mcp_sse_endpoint(
        client: str,
        request: Request,
        background_tasks: BackgroundTasks,
        api_key: Optional[str] = Query(None, alias="key")
    ):
        """SSE endpoint for MCP clients - supergateway compatible"""
        
        # Get API key from query parameter or header
        if not api_key:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                api_key = auth_header[7:]
            else:
                api_key = request.headers.get("X-API-Key")
        
        if not api_key:
            raise HTTPException(status_code=401, detail="API key required")
        
        # Validate API key and get UUIDs
        db = SessionLocal()
        try:
            user = validate_api_key(api_key, db)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid API key")
            
            user_uuid = user.id  # Use UUID primary key
            user_id_str = user.user_id  # Keep string for logging
            
            # Get or create default app for this user
            app = db.query(App).filter_by(owner_id=user_uuid, name="default").first()
            if not app:
                app = App(
                    name="default",
                    owner_id=user_uuid,
                    is_active=True
                )
                db.add(app)
                db.commit()
                db.refresh(app)
            
            app_uuid = app.id
            
        finally:
            db.close()
        
        # Create session
        session_id = str(uuid4())
        message_queue = asyncio.Queue()
        
        sse_sessions[session_id] = {
            "user_uuid": user_uuid,      # For database operations
            "user_id_str": user_id_str,  # For vector store operations  
            "app_uuid": app_uuid,
            "client": client,
            "queue": message_queue
        }
        
        logger.info(f"SSE session created: {session_id} for user: {user_id_str}, client: {client}")
        
        async def cleanup():
            """Clean up session on disconnect"""
            await asyncio.sleep(1)  # Give time for final messages
            if session_id in sse_sessions:
                del sse_sessions[session_id]
                logger.info(f"SSE session cleaned up: {session_id}")
        
        background_tasks.add_task(cleanup)
        
        async def event_generator() -> AsyncGenerator[str, None]:
            """Generate SSE events for supergateway"""
            try:
                # CRITICAL: Send the endpoint event first
                # This tells supergateway where to POST messages
                endpoint_path = f"/mcp/{client}/messages/{session_id}"
                yield f"event: endpoint\ndata: {endpoint_path}\n\n"
                
                logger.info(f"Sent endpoint event: {endpoint_path}")
                
                # Now wait for messages from the queue
                while True:
                    try:
                        if await request.is_disconnected():
                            logger.info(f"Client disconnected: {session_id}")
                            break
                        
                        # Wait for messages with timeout for heartbeat
                        try:
                            message = await asyncio.wait_for(
                                message_queue.get(), 
                                timeout=30.0
                            )
                            # Send message as SSE data
                            yield f"data: {json.dumps(message)}\n\n"
                            logger.debug(f"Sent message via SSE: {message.get('method', message.get('id'))}")
                        except asyncio.TimeoutError:
                            # Send heartbeat comment
                            yield ": keepalive\n\n"
                            
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        logger.error(f"Error in event generator: {e}")
                        break
                        
            except Exception as e:
                logger.error(f"Critical error in SSE generator: {e}")
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            }
        )
    
    @app.post("/mcp/{client}/messages/{session_id}")
    async def mcp_messages_endpoint(
        client: str,
        session_id: str,
        request: Request
    ):
        """Handle messages posted by supergateway"""
        
        session = sse_sessions.get(session_id)
        if not session:
            logger.error(f"Invalid session: {session_id}")
            return {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32600,
                    "message": "Invalid session"
                }
            }
        
        user_uuid = session["user_uuid"]
        user_id_str = session["user_id_str"]
        app_uuid = session["app_uuid"]
        
        try:
            # Get the JSON-RPC request
            rpc_request = await request.json()
            logger.info(f"Received message: {rpc_request.get('method')} (id: {rpc_request.get('id')})")
            
            # Process the request
            method = rpc_request.get("method")
            params = rpc_request.get("params", {})
            request_id = rpc_request.get("id")
            
            # Handle different methods
            response = await process_mcp_request(
                method, params, request_id, user_uuid, user_id_str, app_uuid
            )
            
            # Queue the response to be sent via SSE
            await session["queue"].put(response)
            
            # Return empty response (actual response goes via SSE)
            return {"ok": True}
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            logger.error(traceback.format_exc())
            error_response = {
                "jsonrpc": "2.0",
                "id": rpc_request.get("id") if 'rpc_request' in locals() else None,
                "error": {
                    "code": -32603,
                    "message": "Internal error",
                    "data": str(e)
                }
            }
            await session["queue"].put(error_response)
            return {"ok": True}
    
    # Keep the existing RPC endpoint for direct testing
    @app.post("/mcp/{client}/rpc")
    async def mcp_rpc_endpoint(
        client: str,
        request: Request,
        api_key: Optional[str] = Query(None, alias="key")
    ):
        """Handle JSON-RPC requests directly (for testing)"""
        
        # Validate API key
        if not api_key:
            api_key = request.headers.get("X-API-Key")
        
        if not api_key:
            return {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": "API key required"
                }
            }
        
        db = SessionLocal()
        try:
            user = validate_api_key(api_key, db)
            if not user:
                return {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {
                        "code": -32700,
                        "message": "Invalid API key"
                    }
                }
            
            user_uuid = user.id  # Use UUID primary key
            user_id_str = user.user_id  # Keep string for logging
            
            # Get or create default app for this user
            app = db.query(App).filter_by(owner_id=user_uuid, name="default").first()
            if not app:
                app = App(
                    name="default",
                    owner_id=user_uuid,
                    is_active=True
                )
                db.add(app)
                db.commit()
                db.refresh(app)
            
            app_uuid = app.id
            
        finally:
            db.close()
        
        # Parse JSON-RPC request
        try:
            rpc_request = await request.json()
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": "Parse error",
                    "data": str(e)
                }
            }
        
        method = rpc_request.get("method")
        params = rpc_request.get("params", {})
        request_id = rpc_request.get("id")
        
        # Process and return directly
        return await process_mcp_request(method, params, request_id, user_uuid, user_id_str, app_uuid)


async def process_mcp_request(method: str, params: dict, request_id: Any, user_uuid: str, user_id_str: str, app_uuid: str) -> dict:
    """Process MCP request and return response"""
    
    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2025-06-18",
                "serverInfo": {
                    "name": "openmemory-mcp-server",
                    "version": "1.0.0"
                },
                "capabilities": {
                    "tools": {}
                }
            }
        }
    
    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "tools": [
                    {
                        "name": "add_memory",
                        "description": "Store a memory to maintain continuity across conversations.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "text": {
                                    "type": "string",
                                    "description": "What you want to remember"
                                },
                                "metadata": {
                                    "type": "object",
                                    "description": "Optional metadata to organize memories",
                                    "properties": {
                                        "category": {
                                            "type": "string",
                                            "description": "Primary category to organize this memory"
                                        },
                                        "tags": {
                                            "type": "array",
                                            "description": "Tags for flexible organization",
                                            "items": {
                                                "type": "string"
                                            }
                                        },
                                        "priority": {
                                            "type": "string",
                                            "description": "Priority level for this memory"
                                        }
                                    }
                                }
                            },
                            "required": ["text"]
                        }
                    },
                    {
                        "name": "search_memories",
                        "description": "Search through stored memories using a query",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "query": {
                                    "type": "string",
                                    "description": "The search query"
                                },
                                "limit": {
                                    "type": "integer",
                                    "description": "Maximum number of results to return",
                                    "default": 5
                                }
                            },
                            "required": ["query"]
                        }
                    },
                    {
                        "name": "list_memories",
                        "description": "List all memories for the authenticated user",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "limit": {
                                    "type": "integer",
                                    "description": "Maximum number of memories to return",
                                    "default": 10
                                }
                            }
                        }
                    }
                ]
            }
        }
    
    elif method == "tools/call":
        tool_name = params.get("name")
        tool_args = params.get("arguments", {})
        
        try:
            if tool_name == "add_memory":
                result = await handle_add_memory(user_uuid, user_id_str, app_uuid, tool_args)
            elif tool_name == "search_memories":
                result = await handle_search_memories(user_uuid, user_id_str, app_uuid, tool_args)
            elif tool_name == "list_memories":
                result = await handle_list_memories(user_uuid, user_id_str, app_uuid, tool_args)
            else:
                return {
                    "jsonrpc": "2.0",
                    "id": request_id,
                    "error": {
                        "code": -32602,
                        "message": f"Unknown tool: {tool_name}"
                    }
                }
            
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [{
                        "type": "text",
                        "text": result
                    }]
                }
            }
            
        except Exception as e:
            logger.error(f"Error handling tool call {tool_name}: {e}")
            logger.error(traceback.format_exc())
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": [{
                        "type": "text",
                        "text": f"Error: {str(e)}"
                    }]
                }
            }
    
    else:
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}"
            }
        }


async def handle_add_memory(user_uuid: str, user_id_str: str, app_uuid: str, args: Dict[str, Any]) -> str:
    """Handle add_memory tool call with metadata support (category, tags, priority)"""
    text = args.get("text")
    metadata = args.get("metadata", {})
    
    # Parse metadata if it's a JSON string
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse metadata string: {metadata}")
            metadata = {}
    
    logger.info(f"DEBUG: Received args: {args}")
    logger.info(f"DEBUG: Extracted metadata: {metadata}")
    
    if not text:
        return "Error: 'text' parameter is required"
    
    db = SessionLocal()
    try:
        # Get user (should exist since we validated API key)
        user = db.query(User).filter_by(id=user_uuid).first()
        if not user:
            return "Error: User not found"
        
        # Create memory record with correct column names and UUID types
        memory = Memory(
            id=uuid4(),                    # Generate UUID for memory ID
            user_id=user_uuid,             # Use UUID foreign key
            app_id=app_uuid,               # Use UUID foreign key  
            content=text,                  # Use 'content' column, not 'memory'
            metadata_=metadata,            # Store metadata in the database
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(memory)
        db.commit()
        db.refresh(memory)
        
        # Try to add to vector store if available
        try:
            memory_client = get_memory_client()
            if memory_client:
                # Add to vector store using string user_id
                vector_metadata = {
                    "app_id": str(app_uuid),
                    **metadata  # Include user-provided metadata in vector store
                }
                
                memory_client.add(
                    messages=[{"role": "user", "content": text}],
                    user_id=user_id_str,  # Vector store expects string user_id
                    metadata=vector_metadata,
                )
                logger.info(f"Added memory to vector store for user {user_id_str} with metadata: {metadata}")
        except Exception as e:
            logger.warning(f"Failed to add to vector store: {e}")
            # Continue anyway - database entry was successful
        
        # Format response message
        response_msg = f"Memory stored successfully. ID: {memory.id}"
        
        # Include category, tags, and priority in response if provided
        if "category" in metadata and metadata["category"]:
            response_msg += f"\nCategory: {metadata['category']}"
        
        if "tags" in metadata and metadata["tags"]:
            tags_str = ", ".join(metadata["tags"])
            response_msg += f"\nTags: {tags_str}"
        
        if "priority" in metadata and metadata["priority"]:
            response_msg += f"\nPriority: {metadata['priority']}"
        
        return response_msg
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error adding memory: {e}")
        logger.error(traceback.format_exc())
        raise
    finally:
        db.close()


async def handle_search_memories(user_uuid: str, user_id_str: str, app_uuid: str, args: Dict[str, Any]) -> str:
    """Handle search_memories tool call"""
    query = args.get("query")
    limit = args.get("limit", 5)
    
    if not query:
        return "Error: 'query' parameter is required"
    
    try:
        # Try vector search first
        memory_client = get_memory_client()
        if memory_client:
            results = memory_client.search(
                query=query,
                user_id=user_id_str,  # Vector store expects string user_id
                limit=limit
            )
            
            if results:
                formatted_results = []
                for i, result in enumerate(results, 1):
                    # Vector store returns 'memory' key, but we want 'content'
                    memory_text = result.get("memory", result.get("content", ""))
                    score = result.get("score", 0)
                    metadata = result.get("metadata", {})
                    
                    result_str = f"{i}. {memory_text} (relevance: {score:.2f})"
                    
                    # Include category, tags, and priority if present
                    metadata_parts = []
                    if "category" in metadata and metadata["category"]:
                        metadata_parts.append(f"Category: {metadata['category']}")
                    if "tags" in metadata and metadata["tags"]:
                        metadata_parts.append(f"Tags: {', '.join(metadata['tags'])}")
                    if "priority" in metadata and metadata["priority"]:
                        metadata_parts.append(f"Priority: {metadata['priority']}")
                    
                    if metadata_parts:
                        result_str += f" [{' | '.join(metadata_parts)}]"
                    
                    formatted_results.append(result_str)
                
                return f"Found {len(results)} memories:\n" + "\n".join(formatted_results)
            else:
                return "No memories found matching your query."
    except Exception as e:
        logger.warning(f"Vector search failed: {e}")
    
    # Fallback to database search
    db = SessionLocal()
    try:
        memories = db.query(Memory).filter(
            Memory.user_id == user_uuid,           # Use UUID for database query
            Memory.content.ilike(f"%{query}%")     # Use 'content' column
        ).limit(limit).all()
        
        if memories:
            formatted_results = []
            for i, memory in enumerate(memories, 1):
                result_str = f"{i}. {memory.content}"
                
                # Include category, tags, and priority from metadata if present
                metadata = memory.metadata_ if isinstance(memory.metadata_, dict) else (json.loads(memory.metadata_) if memory.metadata_ else {})
                metadata_parts = []
                if metadata and "category" in metadata:
                    metadata_parts.append(f"Category: {metadata['category']}")
                if metadata and "tags" in metadata:
                    metadata_parts.append(f"Tags: {', '.join(metadata['tags'])}")
                if metadata and "priority" in metadata:
                    metadata_parts.append(f"Priority: {metadata['priority']}")
                
                if metadata_parts:
                    result_str += f" [{' | '.join(metadata_parts)}]"
                
                formatted_results.append(result_str)
            
            return f"Found {len(memories)} memories:\n" + "\n".join(formatted_results)
        else:
            return "No memories found matching your query."
            
    finally:
        db.close()


async def handle_list_memories(user_uuid: str, user_id_str: str, app_uuid: str, args: Dict[str, Any]) -> str:
    """Handle list_memories tool call"""
    limit = args.get("limit", 10)
    
    db = SessionLocal()
    try:
        memories = db.query(Memory).filter_by(
            user_id=user_uuid  # Use UUID for database query
        ).order_by(Memory.created_at.desc()).limit(limit).all()
        
        if not memories:
            return "You have no stored memories yet."
        
        formatted_results = []
        for i, memory in enumerate(memories, 1):
            created_at = memory.created_at.strftime("%Y-%m-%d %H:%M:%S")
            result_str = f"{i}. [{created_at}] {memory.content}"
            
            # Include category, tags, and priority from metadata if present
            metadata = memory.metadata_ if isinstance(memory.metadata_, dict) else (json.loads(memory.metadata_) if memory.metadata_ else {})
            metadata_parts = []
            if metadata and "category" in metadata:
                metadata_parts.append(f"Category: {metadata['category']}")
            if metadata and "tags" in metadata:
                metadata_parts.append(f"Tags: {', '.join(metadata['tags'])}")
            if metadata and "priority" in metadata:
                metadata_parts.append(f"Priority: {metadata['priority']}")
            
            if metadata_parts:
                result_str += f" [{' | '.join(metadata_parts)}]"
            
            formatted_results.append(result_str)
        
        return f"Your {len(memories)} most recent memories:\n" + "\n".join(formatted_results)
        
    finally:
        db.close()
