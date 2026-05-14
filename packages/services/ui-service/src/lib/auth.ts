import { betterAuth } from "better-auth";
import { getAuthBaseConfig } from "./auth-base-config";

export const config = await getAuthBaseConfig();

export default betterAuth(config);
