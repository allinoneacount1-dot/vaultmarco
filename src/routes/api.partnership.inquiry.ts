import { createAPIFileRoute } from "@tanstack/react-start/api";

// Mock in-memory storage for inquiries
const inquiries: Array<{
  id: string;
  name: string;
  email: string;
  organization: string;
  partnershipType: string;
  message: string;
  timestamp: number;
}> = [];

export const Route = createAPIFileRoute("/api/partnership/inquiry")({
  POST: async ({ request }) => {
    try {
      const body = await request.json();
      const { name, email, organization, partnershipType, message } = body;

      if (!name || !email) {
        return new Response(JSON.stringify({ error: "Name and email are required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const newInquiry = {
        id: crypto.randomUUID(),
        name,
        email,
        organization: organization || "",
        partnershipType: partnershipType || "general",
        message: message || "",
        timestamp: Date.now(),
      };

      inquiries.push(newInquiry);

      console.log("New partnership inquiry received:", newInquiry);

      return new Response(JSON.stringify({ success: true, inquiryId: newInquiry.id }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error handling partnership inquiry:", error);
      return new Response(JSON.stringify({ error: "Failed to process inquiry" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
