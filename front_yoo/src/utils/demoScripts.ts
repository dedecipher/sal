export interface DemoScript {
  name: string;
  description: string;
  messages: DemoMessage[];
}

export interface DemoMessage {
  sender: 'HOST' | 'CLIENT';
  text: string;
  delay?: number; // Delay in ms before this message (default: 1000)
  istx?: boolean;
}

export const demoScripts: Record<string, DemoScript> = {
  hotelBooking: {
    name: 'Hotel Booking Demo',
    description: 'A hotel booking conversation between two agents',
    messages: [
      {
        sender: 'CLIENT',
        text: 'Hi, I need to book a hotel room in Seoul for my client.',
        delay: 500,
        istx : false
      },
      {
        sender: 'HOST',
        text: "Hello! I'll help you with the booking. What are your client's preferences for the stay?",
        delay: 4000,
        istx: false
      },
      {
        sender: 'CLIENT',
        text: "Looking for a deluxe room from April 20th to 22nd. Client's preferences include a high floor with city view.",
        delay: 8000,
        istx: false
      },
      {
        sender: 'HOST',
        text: "I've found a matching room. The total cost will be 2.5 SOL. Should I proceed with the booking using secure blockchain payment?",
        delay: 9000,
        istx: false
      },
      {
        sender: 'CLIENT',
        text: "Yes, please proceed. Here's the transaction for 2.5 SOL. Can you sign this and broadcast it?",
        delay: 10000,
        istx: true
      },
      {
        sender: 'HOST',
        text: "Signed and broadcasted. Payment confirmed and verified on the blockchain. Your client's booking is now confirmed. Sending over the booking details now. Thank you!",
        delay: 10000,
        istx: true
      },
      {
        sender: 'CLIENT',
        text: "Great! Confirmed onchain.",
        delay: 14000,
        istx: false
      },
      {
        sender: 'HOST',
        text: "Payment confirmed and verified on the blockchain. Your client’s booking is now confirmed. Sending over the booking details now. Thank you!",
        delay: 5000,
        istx: false
      }
    ]
  }
};
