import api from './api';

const data = (response) => response.data.data;

export const getAdminStats = () => api.get('/admin/stats').then(data);

export const getAdminReels = (params) => api.get('/admin/reels', { params }).then(data);
export const updateAdminReel = (id, payload) => api.patch(`/admin/reels/${id}`, payload).then(data);
export const deleteAdminReel = (id) => api.delete(`/admin/reels/${id}`).then((r) => r.data);

// Uploads can take a while, so this request gets a long timeout and reports progress.
export const createAdminReel = (formData, onProgress) =>
  api
    .post('/admin/reels', formData, {
      timeout: 10 * 60 * 1000,
      onUploadProgress: (event) => {
        if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
      },
    })
    .then(data);

export const createCategory = (payload) => api.post('/admin/categories', payload).then(data);
export const updateCategory = (id, payload) => api.patch(`/admin/categories/${id}`, payload).then(data);
export const deleteCategory = (id) => api.delete(`/admin/categories/${id}`).then((r) => r.data);

export const getAdminReports = (params) => api.get('/admin/reports', { params }).then(data);
export const updateAdminReport = (id, payload) => api.patch(`/admin/reports/${id}`, payload).then((r) => r.data);
