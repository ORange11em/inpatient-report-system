const nextConfig = {
  async rewrites() {
    const developmentOrigin = process.env.NODE_ENV === "development" && process.env.INPATIENT_DEV_API_URL;
    const backendOrigin = (developmentOrigin || process.env.BACKEND_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
    return [
      {
        source: "/api/v1/:path*",
        destination: backendOrigin + "/api/v1/:path*"
      }
    ];
  }
};

export default nextConfig;
