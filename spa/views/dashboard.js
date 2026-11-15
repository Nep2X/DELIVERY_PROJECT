export default {
  route: "dashboard",
  title: "Dashboard",
  group: "Overview",
  async mount(root) {
    root.innerHTML = `
      <div class="spaViewHead">
        <div>
          <h1 tabindex="-1">Dashboard</h1>
          <p>Loading…</p>
        </div>
      </div>`;
    return () => {};
  },
};
