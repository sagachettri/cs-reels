import api from './api';

const data = (response) => response.data.data;

export const likeReel = (id) => api.post(`/reels/${id}/like`).then(data);
export const unlikeReel = (id) => api.delete(`/reels/${id}/like`).then(data);
export const saveReel = (id) => api.post(`/reels/${id}/save`).then(data);
export const unsaveReel = (id) => api.delete(`/reels/${id}/save`).then(data);
export const reportReel = (id, payload) => api.post(`/reels/${id}/report`, payload).then((r) => r.data);
