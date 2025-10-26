'use client';

import { motion } from 'framer-motion';
import { Cloud } from 'lucide-react';

interface RisingCloudProps {
  size?: number;
  className?: string;
}

export function RisingCloud({ size = 64, className = '' }: RisingCloudProps) {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Animated background rings - softer than star */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1.4, 1.2],
          opacity: [0, 0.2, 0.08]
        }}
        transition={{ 
          duration: 2.5,
          delay: 1.4,
          ease: "easeOut"
        }}
      >
        <div className="absolute w-full h-full rounded-full border border-slate-300 opacity-20"></div>
      </motion.div>

      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1.8, 1.6],
          opacity: [0, 0.15, 0.05]
        }}
        transition={{ 
          duration: 3.0,
          delay: 1.6,
          ease: "easeOut"
        }}
      >
        <div className="absolute w-full h-full rounded-full border border-slate-200 opacity-15"></div>
      </motion.div>

      {/* Gentle glow effect */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1.6, 1.4],
          opacity: [0, 0.3, 0.1]
        }}
        transition={{ 
          duration: 3.5,
          delay: 1.8,
          ease: "easeOut"
        }}
      >
        <div className="absolute w-full h-full rounded-full bg-gradient-radial from-slate-200 to-transparent opacity-20"></div>
      </motion.div>

      {/* Trailing cloud effect */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ 
          y: size * 0.4, 
          opacity: 0,
          scale: 0.7
        }}
        animate={{ 
          y: 0, 
          opacity: [0, 1, 0],
          scale: [0.7, 1.05, 1]
        }}
        transition={{ 
          duration: 1.5, 
          ease: "easeOut",
          times: [0, 0.7, 1]
        }}
      >
        <Cloud 
          size={size * 0.7} 
          className="text-slate-400" 
          strokeWidth={1.5}
        />
      </motion.div>

      {/* Rising cloud */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ 
          y: size * 0.6, 
          opacity: 0,
          rotate: -10
        }}
        animate={{ 
          y: [size * 0.6, -size * 0.08, 0],
          opacity: [0, 1, 1],
          rotate: [-10, 3, 0]
        }}
        transition={{ 
          duration: 1.5, 
          ease: "easeOut",
          times: [0, 0.65, 1]
        }}
      >
        <Cloud 
          size={size * 0.65} 
          className="text-slate-500" 
          strokeWidth={2}
        />
      </motion.div>
    </div>
  );
}

