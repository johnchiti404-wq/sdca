import React, { useRef } from 'react';
import { motion } from 'framer-motion';

interface ScrollableSectionProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export const ScrollableSection: React.FC<ScrollableSectionProps> = ({
  children,
  className = '',
  maxHeight = 'max-h-32'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div 
      ref={scrollRef}
      className={`overflow-y-auto scrollbar-hide ${maxHeight} ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      style={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      {children}
    </motion.div>
  );
};