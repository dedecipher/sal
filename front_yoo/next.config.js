/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NEXT_PUBLIC_HOST_PRIVATE_KEY: process.env.NEXT_PUBLIC_HOST_PRIVATE_KEY,
    NEXT_PUBLIC_CLIENT_PRIVATE_KEY: process.env.NEXT_PUBLIC_CLIENT_PRIVATE_KEY,
  },
}

module.exports = nextConfig 