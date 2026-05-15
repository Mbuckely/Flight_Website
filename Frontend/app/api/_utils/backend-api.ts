export function getBackendApiUrl() {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
    "http://localhost:5000"
  );
}
