// ui/app/memories/components/MemoryTable.tsx
'use client';

import { useState, useEffect } from 'react';
import { Trash2, Search, Calendar, User as UserIcon, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import apiService, { Memory, User } from '@/services/api';
// import UpdateMemory from '@/components/shared/update-memory';

interface MemoryTableProps {
  memories: Memory[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export default function MemoryTable({ memories, onDelete, onRefresh }: MemoryTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  // const [editingMemory, setEditingMemory] = useState<{ id: string; content: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const userData = await apiService.getAllUsers();
      setUsers(userData);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const filteredMemories = memories.filter(memory =>
    memory.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getUserDisplay = (memory: Memory) => {
    // Find user from fetched users or use memory's embedded user data
    const user = users.find(u => u.id === memory.user_id) || memory.user;
    
    if (!user) {
      // Use environment override for single-user deployments
      const defaultUserName = process.env.NEXT_PUBLIC_DEFAULT_USER_NAME || 'Unknown';
      return {
        initials: defaultUserName === 'Unknown' ? '?' : apiService.getUserInitials(defaultUserName),
        name: defaultUserName,
        color: defaultUserName === 'Unknown' ? '#6B7280' : apiService.getUserColor(memory.user_id || 'default')
      };
    }

    const name = user.name || user.user_id;
    const initials = apiService.getUserInitials(name);
    const color = apiService.getUserColor(user.user_id);

    return { initials, name, color };
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    
    setLoading(true);
    try {
      await onDelete(id);
      await onRefresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl shadow-lg">
      {/* Search Bar */}
      <div className="p-6 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
              <th className="px-6 py-3 font-medium">Created By</th>
              <th className="px-6 py-3 font-medium">Memory</th>
              <th className="px-6 py-3 font-medium">Created</th>
              <th className="px-6 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMemories.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                  No memories found
                </td>
              </tr>
            ) : (
              filteredMemories.map((memory) => {
                const userDisplay = getUserDisplay(memory);
                return (
                  <tr key={memory.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: userDisplay.color }}
                          title={userDisplay.name}
                        >
                          {userDisplay.initials}
                        </div>
                        <span className="text-sm text-gray-300">{userDisplay.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-200 line-clamp-2">{memory.content}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2 text-gray-400 text-sm">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(memory.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => console.log("Edit clicked for memory:", memory.id)}
                          disabled={loading}
                          className="text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                          title="Edit memory"
                        >
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(memory.id)}
                          disabled={loading}
                          className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                          title="Delete memory"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-700 text-sm text-gray-400">
        Showing {filteredMemories.length} of {memories.length} memories
      </div>

      {/* Edit Memory Dialog */}
      {/* {editingMemory && (
        <UpdateMemory
          memoryId={editingMemory.id}
          memoryContent={editingMemory.content}
          open={!!editingMemory}
          onOpenChange={(open) => {
            if (!open) {
              setEditingMemory(null);
              onRefresh(); // Refresh the table after closing dialog
            }
          }}
        />
      )} */}
    </div>
  );
}
