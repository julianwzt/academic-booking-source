import { apiPost } from "./api";
import { queryClient } from "./queryClient";

/** Call after a successful login — wipes any cached data from a previous identity. */
export async function beginSession() {
  queryClient.clear();
}

/** Every sign-out goes through here: the server clears its cookie and the local cache dies. */
export async function endSession() {
  try {
    await apiPost("/auth/logout");
  } finally {
    queryClient.clear();
  }
}
