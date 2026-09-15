/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "display-capture=(), camera=(self), microphone=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
