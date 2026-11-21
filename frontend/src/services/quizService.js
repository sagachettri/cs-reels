import api from './api';
import { tzOffsetMinutes } from '../utils/time';

const data = (response) => response.data.data;

export const submitQuiz = (quizId, answers) =>
  api.post(`/quizzes/${quizId}/submit`, { answers, tzOffset: tzOffsetMinutes() }).then(data);

export const getQuizAttempts = (params) => api.get('/quizzes/attempts', { params }).then(data);
