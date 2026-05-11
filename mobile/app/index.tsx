import { Redirect } from "expo-router";
import { useAuthStore } from "@/store/authStore";

export default function Index() {
  const token = useAuthStore((state) => state.token);
  return <Redirect href={token ? "/home" : "/login"} />;
}
