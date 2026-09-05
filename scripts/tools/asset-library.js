(() => {
  const search = document.querySelector("#asset-search");
  const group = document.querySelector("#asset-group");
  const sections = [...document.querySelectorAll("[data-asset-folder]")];
  const filter = () => {
    const terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    sections.forEach((section) => {
      let visible = 0;
      section.querySelectorAll("[data-search]").forEach((card) => {
        card.hidden = Boolean(group.value && section.dataset.assetFolder !== group.value) || !terms.every((term) => card.dataset.search.includes(term));
        if (!card.hidden) visible += 1;
      });
      section.hidden = visible === 0;
      const folderLink = document.querySelector(`[data-folder-link="${section.id}"]`);
      folderLink.hidden = section.hidden;
      folderLink.querySelector("span").textContent = visible;
      count += visible;
    });
    document.querySelector("#asset-count").textContent = `${count} ${count === 1 ? "asset" : "assets"}`;
    document.querySelector("#asset-empty").hidden = count !== 0;
  };
  search.addEventListener("input", filter);
  group.addEventListener("change", filter);
  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const status = document.querySelector("#copy-status");
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        status.textContent = `Copied ${button.dataset.copy}`;
      } catch {
        status.textContent = button.dataset.copy;
      }
    });
  });
})();
