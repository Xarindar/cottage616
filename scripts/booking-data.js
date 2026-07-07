(function () {
  window.BookingClientConfig = {
    business: {
      name: "Cottage 616",
      heading: "Book Cottage 616",
      timezone: "America/Chicago"
    },
    api: {
      enabled: true,
      baseUrl: "https://showrunner-beta-production.up.railway.app/api/public/v1",
      publishableKey: "pk_live_ByKzPoI9HTbxIEIidXD68GhgIyQjQaT8",
      sendKeyAsHeader: true,
      demoFallback: false
    },
    currency: "USD",
    schedule: {
      daysToShow: 10,
      minimumNoticeHours: 24,
      maxAdvanceDays: 180,
      demoStartHour: 9,
      demoEndHour: 18,
      demoIntervalMinutes: 30,
      demoClosedWeekdays: [0, 1]
    },
    features: {
      autoSelectFirstStaff: true,
      showStaffFilter: false
    },
    content: {
      enabled: true,
      profile: "cottage616"
    },
    promotion: {
      enabled: true,
      title: "Let's get this party started",
      copy: "Request celebrations, showers, intimate weddings, and Hive head-spa appointments.",
      cta: "Start booking",
      categoryId: "events"
    },
    categories: [
      {
        id: "events",
        name: "Events",
        description: "Parties, showers, intimate weddings, and private celebrations at Cottage 616.",
        imageKey: "events",
        sort: 10
      },
      {
        id: "the-hive",
        name: "The Hive",
        description: "Restorative head-spa appointments inside The Hive at Cottage 616.",
        imageKey: "the-hive",
        sort: 20
      }
    ],
    services: [],
    servicePresentation: {}
  };
})();
