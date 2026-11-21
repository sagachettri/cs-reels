import api from './api';

const data = (response) => response.data.data;

export const explainReel = (id, mode) => api.post(`/ai/reels/${id}/explain`, { mode }, { timeout: 45000 }).then(data);
export const summarizeReel = (id) => api.post(`/ai/reels/${id}/summary`, {}, { timeout: 45000 }).then(data);
export const generateQuiz = (id, difficulty = 'medium') =>
  api.post(`/ai/reels/${id}/quiz`, { difficulty }, { timeout: 60000 }).then(data);
export const askAboutReel = (id, messages) =>
  api.post(`/ai/reels/${id}/chat`, { messages }, { timeout: 45000 }).then(data);
export const askTutor = (messages) => api.post('/ai/chat', { messages }, { timeout: 45000 }).then(data);
