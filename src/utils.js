function panic (error) {
  error = (typeof error !== 'string') ? error : new Error(error);
  throw error;
}

export { panic };
