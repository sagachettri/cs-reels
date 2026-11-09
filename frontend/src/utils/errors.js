// Turns any Axios error into a message a student can understand.
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const serverMessage = error?.response?.data?.error?.message;
  if (serverMessage) return serverMessage;
  if (error?.code === 'ECONNABORTED') return 'The request took too long. Please try again.';
  if (error?.request && !error?.response) return 'Cannot reach the server. Check your internet connection.';
  return fallback;
}

export function getErrorCode(error) {
  return error?.response?.data?.error?.code || '';
}
