/** FAQ content. Plain data so it can later move to a CMS without UI changes. */
export type FaqEntry = { question: string; answer: string[] };

export const FAQ: FaqEntry[] = [
  {
    question: "How do I create an account?",
    answer: [
      "Click “Sign Up” in the top bar and register with your email address. After confirming your email you can top up your balance and request numbers.",
    ],
  },
  {
    question: "How do I add funds to my balance?",
    answer: [
      "Open “Top up” in your profile. Send the amount to the Easypaisa / JazzCash account shown there, then submit a top-up request with the transaction ID from your receipt.",
      "Payments are verified manually by our team; your balance is credited once the payment is approved. For help, use the WhatsApp button on that page.",
    ],
  },
  {
    question: "Why is a country or service out of stock?",
    answer: [
      "Stock changes constantly as numbers are used and new ones are connected. If nothing is available, try another country or check back a little later.",
    ],
  },
  {
    question: "How does buying and activating a number work?",
    answer: [
      "Pick a service and a country, choose a price tier and confirm. You receive a phone number to enter on the target website. The code appears in “Received numbers” as soon as the SMS arrives.",
      "Each number is reserved for a limited time. If no SMS arrives, you can cancel and the funds return to your balance.",
    ],
  },
  {
    question: "I didn't receive an SMS. What now?",
    answer: [
      "Some services occasionally reject certain numbers. Wait a couple of minutes, then cancel the activation to get a refund and try a different number or country.",
    ],
  },
  {
    question: "What is a “used” or blocked number?",
    answer: [
      "Occasionally a number was already registered with the service. Cancel the activation and request a new one — you are not charged for activations that don't receive a code.",
    ],
  },
  {
    question: "Can I use the service through an API?",
    answer: [
      "Yes. Generate an API key in your profile settings and follow the API documentation to automate requests from your own software.",
    ],
  },
  {
    question: "Do you offer bulk pricing?",
    answer: [
      "If you need a large volume of activations, contact us through the feedback form with your expected monthly volume and services.",
    ],
  },
  {
    question: "Are there regional restrictions?",
    answer: [
      "Some services limit which countries can register. Availability shown on the price page already reflects numbers that can be issued.",
    ],
  },
];
