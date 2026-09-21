/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://evxtsgaalqdfsueuxfgr.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "sb_publishable_nxZC6BKIy5O3QmBgKhudLA_eHNYSv2O",
  },
  async redirects() {
    return [
      { source: "/student", destination: "/", permanent: false },
      { source: "/student/:path*", destination: "/", permanent: false },
    ];
  },
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
