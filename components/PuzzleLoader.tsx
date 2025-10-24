'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { LetterState } from '@/lib/contracts';

const stateToClass: Record<LetterState | 'empty', string> = {
  correct: 'bg-green-500 text-white',
  present: 'bg-yellow-400 text-slate-800',
  absent: 'bg-gray-300 text-slate-800 opacity-80',
  empty: 'bg-white text-slate-800 opacity-60'
};

interface PuzzleLoaderProps {
  length?: number;
}

export function PuzzleLoader({ length = 5 }: PuzzleLoaderProps) {
  const [animationPhase, setAnimationPhase] = useState<'empty' | 'flipping' | 'colored' | 'flipping-back'>('empty');
  const [tileStates, setTileStates] = useState<(LetterState | 'empty')[]>(Array(length).fill('empty'));
  const [currentTileIndex, setCurrentTileIndex] = useState(0);

  useEffect(() => {
    // Generate random colors for each animation cycle
    const generateRandomStates = (): LetterState[] => {
      const states: LetterState[] = ['correct', 'present', 'absent'];
      return Array(length).fill(null).map(() => states[Math.floor(Math.random() * states.length)]);
    };

    let timeoutId: NodeJS.Timeout;
    let intervalId: NodeJS.Timeout;

    const startAnimationCycle = () => {
      setAnimationPhase('flipping');
      setCurrentTileIndex(0);
      const randomStates = generateRandomStates();
      
      // Flip tiles one by one with random colors
      intervalId = setInterval(() => {
        setCurrentTileIndex((prevIndex) => {
          if (prevIndex < length - 1) {
            setTileStates((prev) => {
              const newStates = [...prev];
              newStates[prevIndex] = randomStates[prevIndex];
              return newStates;
            });
            return prevIndex + 1;
          } else {
            // Last tile flipped
            setTileStates((prev) => {
              const newStates = [...prev];
              newStates[prevIndex] = randomStates[prevIndex];
              return newStates;
            });
            clearInterval(intervalId);
            setAnimationPhase('colored');
            
            // Wait 1 second, then flip back
            timeoutId = setTimeout(() => {
              setAnimationPhase('flipping-back');
              setCurrentTileIndex(0);
              
              // Flip back to empty one by one
              intervalId = setInterval(() => {
                setCurrentTileIndex((prevIndex) => {
                  if (prevIndex < length - 1) {
                    setTileStates((prev) => {
                      const newStates = [...prev];
                      newStates[prevIndex] = 'empty';
                      return newStates;
                    });
                    return prevIndex + 1;
                  } else {
                    // Last tile flipped back
                    setTileStates((prev) => {
                      const newStates = [...prev];
                      newStates[prevIndex] = 'empty';
                      return newStates;
                    });
                    clearInterval(intervalId);
                    setAnimationPhase('empty');
                    
                    // Wait 1 second, then start next cycle
                    timeoutId = setTimeout(() => {
                      startAnimationCycle();
                    }, 1000);
                    
                    return prevIndex;
                  }
                });
              }, 90); // Slightly faster flip back
              
              return prevIndex;
            }, 1000);
            
            return prevIndex;
          }
        });
      }, 90); // Flip timing
    };

    // Start the first animation cycle after a brief delay
    timeoutId = setTimeout(() => {
      startAnimationCycle();
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [length]);

  return (
    <div className="flex justify-center">
      <div 
        className="grid justify-center"
        style={{ 
          gap: '3px', // Smaller gap for 1/3 scale
          gridTemplateColumns: `repeat(${length}, 19px)` // 1/3 of 56px ≈ 19px
        }}
      >
        {Array.from({ length }).map((_, index) => {
          const state = tileStates[index];
          const isCurrentlyFlipping = 
            (animationPhase === 'flipping' && index === currentTileIndex) ||
            (animationPhase === 'flipping-back' && index === currentTileIndex);
          
          return (
            <motion.span
              key={index}
              className={clsx(
                'relative flex h-5 w-5 items-center justify-center rounded-sm border text-xs font-semibold transition-colors font-sans',
                'border-blue-200',
                stateToClass[state]
              )}
              initial={{ rotateX: 0 }}
              animate={isCurrentlyFlipping ? { rotateX: [0, 90, 0] } : {}}
              transition={{
                duration: 0.15,
                times: [0, 0.5, 1]
              }}
            >
              {/* Empty tiles show no content */}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
}
