'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Brain, 
  Plus, 
  Search, 
  Trash2, 
  Calendar,
  User as UserIcon,
  RefreshCw,
  LogOut,
  Tag as TagIcon,
  Flag
} from 'lucide-react';
import apiService, { Memory, User, PaginatedResponse } from '@/services/api';

export default function MemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [creating, setCreating] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    checkAuth();
    fetchMemories();
    fetchUsers();
  }, [currentPage, pageSize]);

  const checkAuth = () => {
    if (typeof window === 'undefined') return;
    
    const apiKey = sessionStorage.getItem('api_key') || localStorage.getItem('api_key');
    const userId = sessionStorage.getItem('user_id') || localStorage.getItem('user_id');
    const userName = sessionStorage.getItem('user_name') || localStorage.getItem('user_name');

    if (!apiKey) {
      router.push('/login');
      return;
    }

    setCurrentUser({ userId, userName, apiKey: apiKey.substring(0, 10) + '...' });
  };

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const response: PaginatedResponse<Memory> = await apiService.getMemories({
        page: currentPage,
        size: pageSize,
        state: 'active'
      });
      
      setMemories(response.items || []);
      setTotalPages(response.pages || 1);
      setTotalItems(response.total || 0);
    } catch (error) {
      console.error('Failed to fetch memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const userData = await apiService.getAllUsers();
      setUsers(userData);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleCreateMemory = async () => {
    if (!newMemoryContent.trim()) return;
    
    setCreating(true);
    try {
      await apiService.createMemory(newMemoryContent);
      setNewMemoryContent('');
      setShowCreateDialog(false);
      fetchMemories(); // Refresh the list
    } catch (error) {
      console.error('Failed to create memory:', error);
      alert('Failed to create memory');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    
    try {
      await apiService.deleteMemory(id);
      fetchMemories(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete memory:', error);
      alert('Failed to delete memory');
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      localStorage.clear();
    }
    router.push('/login');
  };

  const getUserDisplay = (memory: Memory) => {
    const user = users.find(u => u.id === memory.user_id) || memory.user;
    
    if (!user) {
      return { initials: '?', name: 'Unknown', color: '#6B7280' };
    }

    const name = user.name || user.user_id;
    const initials = apiService.getUserInitials(name);
    const color = apiService.getUserColor(user.user_id);

    return { initials, name, color };
  };

  // Helper function to check if priority is high/urgent
  const isHighPriority = (priority?: string): boolean => {
    if (!priority) return false;
    const p = priority.toLowerCase();
    return p.includes('high') || p.includes('urgent') || p.includes('critical') || p.includes('important');
  };

  // Helper function to check if priority is medium
  const isMediumPriority = (priority?: string): boolean => {
    if (!priority) return false;
    const p = priority.toLowerCase();
    return p.includes('medium') || p.includes('normal');
  };

  // Get priority styling - now ALWAYS returns a style with flag icon
  const getPriorityStyle = (priority?: string) => {
    if (!priority) return null;
    
    if (isHighPriority(priority)) {
      return {
        borderColor: 'border-red-500',
        bgColor: 'bg-red-500/10',
        textColor: 'text-red-400',
        badgeBg: 'bg-red-500/20',
        icon: <Flag className="h-3 w-3" />
      };
    } else if (isMediumPriority(priority)) {
      return {
        borderColor: 'border-yellow-500',
        bgColor: 'bg-yellow-500/10',
        textColor: 'text-yellow-400',
        badgeBg: 'bg-yellow-500/20',
        icon: <Flag className="h-3 w-3" />
      };
    }
    
    // Default style for all other priorities (low, custom, etc.) - includes flag icon
    return {
      borderColor: '',
      bgColor: '',
      textColor: 'text-gray-300',
      badgeBg: 'bg-gray-700',
      icon: <Flag className="h-3 w-3" />
    };
  };

  const filteredMemories = memories.filter(memory =>
    memory.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Brain className="h-8 w-8 text-blue-400" />
              <h1 className="text-2xl font-bold text-white">OpenMemory</h1>
            </div>
            <div className="flex items-center space-x-4">
              {currentUser && (
                <div className="flex items-center space-x-2 text-gray-300">
                  <UserIcon className="h-4 w-4" />
                  <span>{currentUser.userName}</span>
                </div>
              )}
              <button
                onClick={fetchMemories}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Create Memory</span>
          </button>
        </div>

        {/* Stats */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-gray-300">
              <span className="text-2xl font-bold text-white">{totalItems}</span> total memories
            </div>
            <div className="text-gray-400 text-sm">
              Page {currentPage} of {totalPages} • {pageSize} per page
            </div>
          </div>
        </div>

        {/* Memories List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <Brain className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No memories found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search' : 'Create your first memory to get started'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMemories.map((memory) => {
              const userDisplay = getUserDisplay(memory);
              const metadata = memory.metadata;
              const priorityStyle = metadata?.priority ? getPriorityStyle(metadata.priority) : null;
              
              return (
                <div
                  key={memory.id}
                  className={`bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors ${
                    priorityStyle?.borderColor ? `border-l-4 ${priorityStyle.borderColor}` : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* User and Date Info */}
                      <div className="flex items-center space-x-3 mb-2">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: userDisplay.color }}
                        >
                          {userDisplay.initials}
                        </div>
                        <span className="text-gray-400 text-sm">{userDisplay.name}</span>
                        <span className="text-gray-500 text-sm">•</span>
                        <span className="text-gray-500 text-sm flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(memory.created_at)}
                        </span>
                      </div>

                      {/* Category Badge */}
                      {metadata?.category && (
                        <div className="mb-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                            {metadata.category}
                          </span>
                        </div>
                      )}

                      {/* Memory Content */}
                      <p className="text-gray-100 mb-3">{memory.content}</p>

                      {/* Tags and Priority Row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Tag Chips */}
                        {metadata?.tags && metadata.tags.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {metadata.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600"
                              >
                                <TagIcon className="h-3 w-3 mr-1" />
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Priority Badge - now always shows flag icon */}
                        {metadata?.priority && priorityStyle && (
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium gap-1 ${
                              priorityStyle.badgeBg
                            } ${priorityStyle.textColor} border ${
                              priorityStyle.borderColor 
                                ? `border-${priorityStyle.borderColor.split('-')[1]}-500/30`
                                : 'border-gray-600'
                            }`}
                          >
                            {priorityStyle.icon}
                            {metadata.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Delete Button */}
                    <button
                      onClick={() => handleDeleteMemory(memory.id)}
                      className="ml-4 p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete memory"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center space-x-2 mt-8">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-300">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </main>

      {/* Create Memory Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Create New Memory</h2>
            <textarea
              value={newMemoryContent}
              onChange={(e) => setNewMemoryContent(e.target.value)}
              placeholder="Enter your memory..."
              className="w-full h-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewMemoryContent('');
                }}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMemory}
                disabled={!newMemoryContent.trim() || creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
