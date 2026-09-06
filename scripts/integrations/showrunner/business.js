(function () {
  "use strict";
  const pages = { "index.html": "home", "the-hive.html": "hive", "booking.html": "booking", "vendors.html": "vendors" };
  const page = pages[location.pathname.split("/").pop() || "index.html"];
  if (!page) return;
  window.addEventListener("showrunner:render", event => {
    const business = event.detail.blocks?.find(block => block.type === "business");
    if (business) applyBusiness({ businessConfigured: true, business: business.payload });
  });
  const endpoint = new URL("https://showrunner-beta-production.up.railway.app/api/public/v1/content/studio");
  endpoint.searchParams.set("page", page);
  fetch(endpoint, { headers: { "X-Showrunner-Key": "pk_live_ByKzPoI9HTbxIEIidXD68GhgIyQjQaT8" } })
    .then(response => { if (!response.ok) throw new Error("Business info unavailable"); return response.json(); })
    .then(applyBusiness).catch(() => { /* Static contact and metadata remain available during outages. */ });
  function applyBusiness(response) {
      const data = response.data || response;
      const seo = data.blocks?.find(block => block.type === "seo")?.payload;
      if (seo?.title) document.title = seo.title;
      if (seo?.description) {
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) { meta = document.createElement("meta"); meta.name = "description"; document.head.append(meta); }
        meta.content = seo.description;
      }
      // Keep approved static fallback values until the canonical record is initialized.
      if (!data.businessConfigured) return;
      const business = data.business;
      document.querySelectorAll("[data-business-phone]").forEach(node => { node.textContent = business.phone || ""; node.href = `tel:${String(business.phone || "").replace(/[^+\d]/g, "")}`; node.hidden = !business.phone; });
      document.querySelectorAll("[data-business-email]").forEach(node => { node.textContent = business.email || ""; node.href = `mailto:${business.email || ""}`; node.hidden = !business.email; });
      document.querySelectorAll("[data-business-address]").forEach(node => { node.textContent = [business.line1, business.line2, business.city, [business.region, business.postalCode].filter(Boolean).join(" "), business.country].filter(Boolean).join(", "); });
      document.querySelectorAll("[data-business-name]").forEach(node => { node.textContent = business.businessName; });
      document.querySelectorAll("form[data-business-email-action]").forEach(form => { form.action = `mailto:${business.email || ""}`; });
      document.querySelectorAll("[data-business-social]").forEach(container => {
        container.replaceChildren();
        (business.socialLinks || []).forEach(item => {
          if (!/^https?:\/\//i.test(item.href)) return;
          const link = document.createElement("a"); link.href = item.href; link.textContent = item.platform; container.append(link);
        });
      });
    }
})();
