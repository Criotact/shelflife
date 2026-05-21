import React, { useState } from "react";
import { 
  Globe, 
  Key, 
  User, 
  Lock, 
  Activity, 
  Check, 
  AlertCircle, 
  ArrowRight,
  ShieldAlert,
  Server
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import axios from "axios";
import { api } from "../lib/api";
import { Capacitor } from "@capacitor/core";

interface ConnectionScreenProps {
  onSuccess: () => void;
}

export function ConnectionScreen({ onSuccess }: ConnectionScreenProps) {
  const [url, setUrl] = useState("");
  const [authMethod, setAuthMethod] = useState<"credentials" | "token">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error" | ""; message: string }>({
    type: "",
    message: "",
  });

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) {
      setStatus({ type: "error", message: "Server URL is required." });
      return;
    }

    setLoading(true);
    setStatus({ type: "", message: "" });

    // Normalize URL
    let formattedUrl = url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `http://${formattedUrl}`;
    }
    if (formattedUrl.endsWith("/")) {
      formattedUrl = formattedUrl.slice(0, -1);
    }

    try {
      let resolvedToken = "";

      // If credentials auth, fetch token from /api/login
      if (authMethod === "credentials") {
        if (!username || !password) {
          setStatus({ type: "error", message: "Username and password are required." });
          setLoading(false);
          return;
        }

        const isNative = Capacitor.isNativePlatform();
        const loginUrl = isNative ? `${formattedUrl}/api/login` : `/api/abs/login`;

        const loginRes = await axios.post(
          loginUrl,
          { username, password },
          { 
            headers: { 
              "Content-Type": "application/json",
              ...(isNative ? {} : { "X-ABS-URL": formattedUrl })
            }, 
            timeout: 8000 
          }
        );

        resolvedToken = loginRes.data?.user?.token;
        if (!resolvedToken) {
          throw new Error("Could not retrieve authentication token from server.");
        }
      } else {
        if (!token) {
          setStatus({ type: "error", message: "API Token is required." });
          setLoading(false);
          return;
        }
        resolvedToken = token.trim();
      }

      // Initialize API client temporarily to verify config
      await api.saveConnection(formattedUrl, resolvedToken);
      const health = await api.checkHealth();

      if (health.ok) {
        setStatus({ type: "success", message: "Successfully connected to Audiobookshelf!" });
        setTimeout(() => {
          onSuccess();
        }, 1200);
      } else {
        await api.disconnect(); // Clear credentials
        setStatus({
          type: "error",
          message: health.error || "Connection verified, but authorization failed.",
        });
      }
    } catch (err: any) {
      console.error(err);
      await api.disconnect(); // Clear credentials
      let errorMsg = "Could not reach server. Verify the URL is correct and online.";
      
      if (err.response) {
        if (err.response.status === 401) {
          errorMsg = "Invalid username or password.";
        } else if (err.response.data?.error) {
          errorMsg = err.response.data.error;
        }
      } else if (err.code === "ECONNABORTED") {
        errorMsg = "Connection timed out. Check your network or URL.";
      }
      
      setStatus({
        type: "error",
        message: errorMsg,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 selection:bg-indigo-100 selection:text-indigo-900 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10 relative overflow-hidden"
      >
        {/* Sleek aesthetic background accent */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10" />
        
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-extrabold italic shadow-lg shadow-indigo-100 ring-4 ring-indigo-50 mx-auto mb-4">
            S
          </div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Shelf<span className="text-indigo-600">Life</span>
          </h2>
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mt-1.5">
            Connect your Audiobookshelf Server
          </p>
        </div>

        <form onSubmit={handleConnect} className="space-y-5">
          {/* Server URL Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              Server URL
            </label>
            <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl group focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-500 transition-all">
              <Globe size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="https://abs.example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="bg-transparent border-none text-xs font-semibold focus:ring-0 placeholder:text-slate-400 w-full outline-none text-slate-800"
                required
              />
            </div>
            <p className="text-[10px] text-slate-400/80 font-medium">
              E.g. http://192.168.1.50:5000 or domain address
            </p>
          </div>

          {/* Auth Method Selector */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setAuthMethod("credentials")}
              disabled={loading}
              className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                authMethod === "credentials"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Credentials
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod("token")}
              disabled={loading}
              className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                authMethod === "token"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              API Token
            </button>
          </div>

          {/* Dynamic Auth Forms */}
          <AnimatePresence mode="wait">
            {authMethod === "credentials" ? (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Username */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Username
                  </label>
                  <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl group focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-500 transition-all">
                    <User size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="text"
                      placeholder="Username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                      className="bg-transparent border-none text-xs font-semibold focus:ring-0 placeholder:text-slate-400 w-full outline-none text-slate-800"
                      required={authMethod === "credentials"}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                    Password
                  </label>
                  <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl group focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-500 transition-all">
                    <Lock size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="bg-transparent border-none text-xs font-semibold focus:ring-0 placeholder:text-slate-400 w-full outline-none text-slate-800"
                      required={authMethod === "credentials"}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="token"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-1.5"
              >
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                  API Token / Personal Access Token
                </label>
                <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-2xl group focus-within:ring-2 focus-within:ring-indigo-100 focus-within:border-indigo-500 transition-all">
                  <Key size={16} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="password"
                    placeholder="Paste API token from User Settings"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={loading}
                    className="bg-transparent border-none text-xs font-semibold focus:ring-0 placeholder:text-slate-400 w-full outline-none text-slate-800"
                    required={authMethod === "token"}
                  />
                </div>
                <p className="text-[10px] text-slate-400/80 font-medium">
                  Can be generated in your Audiobookshelf User Profile under "API Tokens".
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button & Status Info */}
          <div className="pt-2">
            <AnimatePresence mode="wait">
              {status.type && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`p-4 rounded-2xl flex items-start gap-3 mb-4 text-xs font-semibold ${
                    status.type === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                      : "bg-rose-50 text-rose-800 border border-rose-100"
                  }`}
                >
                  {status.type === "success" ? (
                    <Check size={16} className="shrink-0 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                  )}
                  <div className="leading-relaxed">{status.message}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[11px] font-bold uppercase tracking-wider transition-all hover:shadow-lg hover:shadow-indigo-100 flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Activity size={14} className="animate-spin" />
                  Connecting Instance...
                </>
              ) : (
                <>
                  Establish Link
                  <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
