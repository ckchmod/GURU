const apiBaseUrl = process.env.GURU_API_BASE_URL ?? "http://127.0.0.1:8000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/knowledgebase/:path*",
        destination: `${apiBaseUrl}/knowledgebase/:path*`
      }
    ];
  }
};

export default nextConfig;
