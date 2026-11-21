// The server accepts at most 12 messages and the first one should come from the user.
export function buildRequestMessages(messages) {
  const recent = messages.slice(-11);
  const firstUser = recent.findIndex((m) => m.role === 'user');
  return recent.slice(firstUser === -1 ? 0 : firstUser).map(({ role, content }) => ({ role, content }));
}
