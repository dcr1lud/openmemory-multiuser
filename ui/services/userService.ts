// ui/services/userService.ts
import { setAvailableUsers, setProfileLoading, setProfileError, setProfileSuccess, User } from '@/store/profileSlice';
import { Dispatch } from '@reduxjs/toolkit';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://mem-lab.duckdns.org:8765';

// Transform API user response to our User interface
const transformApiUser = (apiUser: any): User => ({
  id: apiUser.user_id || apiUser.id,
  name: apiUser.user_id || apiUser.id,
  displayName: apiUser.name || apiUser.display_name || apiUser.user_id,
  isActive: true, // Assume active if returned by API
  createdAt: apiUser.created_at || new Date().toISOString()
});

export const loadUsersFromAPI = async (dispatch: Dispatch) => {
  dispatch(setProfileLoading());

  try {
    // First, try to get users from the API
    const response = await fetch(`${API_BASE_URL}/api/v1/users`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const apiUsers = await response.json();

    // Transform API users to our format
    const users: User[] = apiUsers.map(transformApiUser);

    // If we have users, set them
    if (users.length > 0) {
      dispatch(setAvailableUsers(users));
      dispatch(setProfileSuccess());
    } else {
      // No users found - this is actually OK for a fresh system
      dispatch(setAvailableUsers([]));
      dispatch(setProfileSuccess());
    }

  } catch (error) {
    console.error('Failed to load users from API:', error);
    
    // Set error but don't crash - the system can still work with login
    dispatch(setProfileError('Unable to load users. You can still log in with an API key.'));
    dispatch(setAvailableUsers([]));
  }
};

// Hook to use in components
export const useUserLoader = () => {
  const loadUsers = (dispatch: Dispatch) => loadUsersFromAPI(dispatch);
  return { loadUsers };
};
