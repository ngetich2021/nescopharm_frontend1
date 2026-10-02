import { useEffect } from "react";
import { SocketService } from "@/lib/realtime";
import { useAuth } from "@/lib/auth-context";

export const useWebSocket = () => {
  const { user, isLoading } = useAuth();
  const socketService = SocketService.getInstance();

  useEffect(() => {
    if (!isLoading && user) {
      // Get token from localStorage
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : undefined;
      socketService.connect(token || undefined);
    }
    return () => {
      socketService.disconnect();
    };
    // Only re-run if user or isLoading changes
  }, [user, isLoading]);

  return socketService;
}; 