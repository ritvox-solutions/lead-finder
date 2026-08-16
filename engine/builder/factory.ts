export function sceneFor(category: string): string {
  switch (category) {
    case "food": return "float";
    case "medical": return "float";
    case "professional": return "planet";
    case "retail": return "shapes";
    case "beauty": return "rings";
    case "automotive": return "planet";
    case "home": return "shapes";
    case "education": return "rings";
    default: return "particles";
  }
}

export function taglineFor(category: string): string {
  switch (category) {
    case "food": return "Taste the difference, made fresh for you";
    case "medical": return "Caring for your health, close to home";
    case "professional": return "Trusted expertise committed to your goals";
    case "retail": return "Find what you love, right around the corner";
    case "beauty": return "Look good, feel even better";
    case "automotive": return "Keep moving, we've got you covered";
    case "home": return "Building comfort, one detail at a time";
    case "education": return "Learn more, grow further";
    default: return "Your neighborhood experts";
  }
}

export function servicesFor(category: string): string[] {
  switch (category) {
    case "food":
      return ["Dine-in", "Takeaway", "Birthday & event catering", "Seasonal menu specials"];
    case "medical":
      return ["General consultations", "Preventive check-ups", "Specialist referrals", "Same-week appointments"];
    case "professional":
      return ["Strategic advice", "Personalized planning", "Ongoing support", "Transparent pricing"];
    case "retail":
      return ["Curated selection", "Special orders", "Gift wrapping", "Loyalty program"];
    case "beauty":
      return ["Signature treatments", "Appointments online", "Skin & hair care", "Gift packages"];
    case "automotive":
      return ["Scheduled servicing", "Express diagnostics", "Repairs & parts", "Pickup & drop-off"];
    case "home":
      return ["Free on-site estimate", "Skilled workmanship", "Project management", "Warranty-backed work"];
    case "education":
      return ["Expert instructors", "Flexible schedules", "Small class sizes", "Beginner to advanced"];
    default:
      return ["Expert service", "Quick turnaround", "Free quotes", "Satisfaction guaranteed"];
  }
}