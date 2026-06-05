import apiClient from '../utils/apiClient';
import type { LoginRequest, LoginResponse, User } from '../types/api';

export const authService = {
  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse>('/auth/login', data),

  getMe: () =>
    apiClient.get<User>('/auth/me'),
};
