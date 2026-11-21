import api from './api';
import { tzOffsetMinutes } from '../utils/time';

const data = (response) => response.data.data;

export const recordView = (reelId, payload) =>
  api.post(`/reels/${reelId}/view`, { ...payload, tzOffset: tzOffsetMinutes() }).then(data);

export const getRecommended = (params) => api.get('/reels/recommended', { params }).then(data);

export const getProgress = () => api.get('/progress', { params: { tzOffset: tzOffsetMinutes() } }).then(data);
