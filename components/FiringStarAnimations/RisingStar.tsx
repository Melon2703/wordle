'use client';

import { motion } from 'framer-motion';

interface RisingStarProps {
  size?: number;
  className?: string;
}

export function RisingStar({ size = 64, className = '' }: RisingStarProps) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Animated background rings */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1.5, 1.2],
          opacity: [0, 0.3, 0.1]
        }}
        transition={{ 
          duration: 2.0,
          delay: 1.2, // Start after rising animation
          ease: "easeOut"
        }}
      >
        <div className="absolute w-full h-full rounded-full border-2 border-yellow-300 opacity-30"></div>
      </motion.div>

      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 2, 1.5],
          opacity: [0, 0.2, 0.05]
        }}
        transition={{ 
          duration: 2.5,
          delay: 1.4, // Slightly delayed second ring
          ease: "easeOut"
        }}
      >
        <div className="absolute w-full h-full rounded-full border border-yellow-200 opacity-20"></div>
      </motion.div>

      {/* Pulsing glow effect */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1.8, 1.6],
          opacity: [0, 0.4, 0.1]
        }}
        transition={{ 
          duration: 3.0,
          delay: 1.6, // Start after rings
          ease: "easeOut"
        }}
      >
        <div className="absolute w-full h-full rounded-full bg-gradient-radial from-yellow-200 to-transparent opacity-30"></div>
      </motion.div>

      {/* Trail */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ 
          y: size * 0.5, 
          opacity: 0,
          scale: 0.8
        }}
        animate={{ 
          y: 0, 
          opacity: [0, 1, 0],
          scale: [0.8, 1.1, 1]
        }}
        transition={{ 
          duration: 1.0, 
          ease: "easeOut",
          times: [0, 0.7, 1]
        }}
      >
        <svg
          width={size * 0.8}
          height={size * 0.8}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="1"
          />
        </svg>
      </motion.div>

      {/* Rising star */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ 
          y: size * 0.8, 
          opacity: 0,
          rotate: -15
        }}
        animate={{ 
          y: [size * 0.8, -size * 0.1, 0],
          opacity: [0, 1, 1],
          rotate: [-15, 5, 0]
        }}
        transition={{ 
          duration: 1.2, 
          ease: "easeOut",
          times: [0, 0.6, 1]
        }}
      >
        <svg
          width={size * 0.7}
          height={size * 0.7}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="1"
          />
        </svg>
      </motion.div>
    </div>
  );
}
