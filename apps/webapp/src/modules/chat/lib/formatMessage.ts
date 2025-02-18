export const formatMessage = (message: string) => {
  // In the chatbot response the token symbols come prefixed with \$, this function removes the backslash
  // In the future we can use this \$ to identify the token symbols and replace them with icons or links

  return message.replaceAll('\\$', '');
};
