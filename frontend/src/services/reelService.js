import api from './api';

const data = (response) => response.data.data;

export const getFeed = (params) => api.get('/reels', { params }).then(data);
export const searchReels = (params) => api.get('/reels/search', { params }).then(data);
export const getReel = (id) => api.get(`/reels/${id}`).then(data);
export const getRelatedReels = (id) => api.get(`/reels/${id}/related`).then(data);
export const getCategories = () => api.get('/categories').then(data);

export const getProfile = () => api.get('/users/me').then(data);
export const updateProfile = (payload) => api.patch('/users/me', payload).then(data);
export const getSavedReels = (params) => api.get('/users/me/saved', { params }).then(data);
export const getLikedReels = (params) => api.get('/users/me/liked', { params }).then(data);
