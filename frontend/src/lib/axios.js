import axios from "axios";
import { API_BASE_URL } from "./config.js";

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
});
