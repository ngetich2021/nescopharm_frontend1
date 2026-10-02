import React, { useState, useEffect } from "react";
import { getChatCredentials, saveChatCredentials, testChatCredentials } from "@/lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FaWhatsapp, FaInstagram, FaFacebookMessenger } from "react-icons/fa";

const PLATFORMS = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: <FaWhatsapp className="text-green-500 w-4 h-4 mr-2" />,
    fields: [
      { name: "app_id", label: "App ID", type: "text", required: true },
      { name: "access_token", label: "Access Token", type: "text", required: true },
      { name: "app_secret", label: "App Secret", type: "text", required: true },
      { name: "phone_number_id", label: "Phone Number ID", type: "text", required: true },
      { name: "business_account_id", label: "Business Account ID", type: "text", required: true },
      { name: "webhook_verify_token", label: "Verify Token", type: "text", required: true },
      { name: "webhook_url", label: "Webhook URL", type: "text", required: false },
    ],
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: <FaInstagram className="text-pink-500 w-4 h-4 mr-2" />,
    fields: [
      { name: "app_id", label: "App ID", type: "text", required: true },
      { name: "access_token", label: "Access Token", type: "text", required: true },
      { name: "app_secret", label: "App Secret", type: "text", required: true },
      { name: "instagram_business_account_id", label: "Business Account ID", type: "text", required: true },
      { name: "webhook_verify_token", label: "Verify Token", type: "text", required: true },
      { name: "webhook_url", label: "Webhook URL", type: "text", required: false },
    ],
  },
  {
    key: "messenger",
    label: "Messenger",
    icon: <FaFacebookMessenger className="text-blue-500 w-4 h-4 mr-2" />,
    fields: [
      { name: "app_id", label: "App ID", type: "text", required: true },
      { name: "access_token", label: "Access Token", type: "text", required: true },
      { name: "app_secret", label: "App Secret", type: "text", required: true },
      { name: "page_id", label: "Page ID", type: "text", required: true },
      { name: "webhook_verify_token", label: "Verify Token", type: "text", required: true },
      { name: "webhook_url", label: "Webhook URL", type: "text", required: false },
    ],
  },
];

export default function ChatSetup() {
  const [activePlatform, setActivePlatform] = useState("whatsapp");
  const [formState, setFormState] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  // Track visibility for each field
  const [fieldVisibility, setFieldVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setError(null);
    setSuccess(null);
    setTestResult(null);
    setFormState({});
    setFieldVisibility({});
    setLoading(true);
    getChatCredentials()
      .then((data) => {
        if (data && Array.isArray(data)) {
          const cred = data.find((c) => c.platform === activePlatform);
          if (cred) {
            setFormState({ ...cred, id: cred.id });
            // Hide all fields by default
            const vis: Record<string, boolean> = {};
            Object.keys(cred).forEach((k) => { vis[k] = false; });
            setFieldVisibility(vis);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activePlatform]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleToggleVisibility = (field: string) => {
    setFieldVisibility((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    // Validate required fields
    const platformFields = PLATFORMS.find((p) => p.key === activePlatform)?.fields || [];
    for (const field of platformFields) {
      if (field.required && !formState[field.name]) {
        setError(`Please fill in the ${field.label}`);
        setLoading(false);
        return;
      }
    }
    try {
      const resp = await saveChatCredentials({ ...formState, platform: activePlatform });
      setSuccess("Credentials saved successfully.");
      setError(null);
      setFormState({ ...formState, id: resp.id });
    } catch (err: any) {
      setError(err.message || "Failed to save credentials.");
      setSuccess(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    setLoading(true);
    try {
      if (!formState.id) {
        setError("Please save credentials first.");
        setLoading(false);
        return;
      }
      const resp = await testChatCredentials(formState.id);
      setTestResult(resp.status === "success" ? "Test successful!" : resp.message || "Test failed.");
    } catch (err: any) {
      setTestResult(err.message || "Test failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 w-full">
      <h2 className="text-2xl font-bold mb-6">Chat Platform Credentials</h2>
      <Tabs value={activePlatform} onValueChange={setActivePlatform} className="mb-6">
        <TabsList className="grid w-fit grid-cols-3 bg-gray-100 rounded-lg p-1">
          {PLATFORMS.map((platform) => (
            <TabsTrigger
              key={platform.key}
              value={platform.key}
              className="flex items-center data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:font-semibold data-[state=active]:text-black data-[state=inactive]:text-gray-500 px-4 py-2 rounded-md text-sm transition"
            >
              {platform.icon}
              {platform.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {PLATFORMS.map((platform) => (
          <TabsContent key={platform.key} value={platform.key} className="mt-0">
            <form
              className="space-y-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm w-full max-w-2xl"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              {platform.fields.map((field) => (
                <div key={field.name} className="relative">
                  <label className="block text-sm font-medium mb-1" htmlFor={field.name}>
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    id={field.name}
                    name={field.name}
                    type={fieldVisibility[field.name] ? field.type : "password"}
                    value={formState[field.name] || ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-16"
                    required={field.required}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-7 text-xs text-blue-600 hover:underline focus:outline-none"
                    tabIndex={-1}
                    onClick={() => handleToggleVisibility(field.name)}
                  >
                    {fieldVisibility[field.name] ? "Hide" : "Show"}
                  </button>
                </div>
              ))}
              {error && <div className="text-red-600 text-sm font-medium">{error}</div>}
              {success && <div className="text-green-600 text-sm font-medium">{success}</div>}
              {testResult && <div className="text-blue-600 text-sm font-medium">{testResult}</div>}
              <div className="flex gap-3 mt-4">
                <button
                  type="submit"
                  className="bg-[#E30040] hover:bg-[#C30038] text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60"
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium border border-gray-300"
                  onClick={handleTest}
                  disabled={loading || !formState.id}
                >
                  {loading ? "Testing..." : "Test"}
                </button>
              </div>
            </form>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
} 