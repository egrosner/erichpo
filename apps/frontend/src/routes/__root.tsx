import { AuthProvider } from "@/lib/auth";
import { Outlet, createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <AuthProvider>
      <div className="min-h-screen">
        <Outlet />
      </div>
    </AuthProvider>
  );
}
