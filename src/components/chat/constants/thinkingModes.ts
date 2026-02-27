import { Brain, Zap, Sparkles, Atom, Rocket } from 'lucide-react';

export const thinkingModes = [
  {
    id: 'none',
    name: 'Standard',
    description: 'Regular Claude response',
    icon: Zap,
    prefix: '',
    color: 'text-gray-600'
  },
  {
    id: 'think',
    name: 'Think',
    description: 'Basic extended thinking',
    icon: Brain,
    prefix: 'think',
    color: 'text-blue-600'
  },
  {
    id: 'think-hard',
    name: 'Think Hard',
    description: 'More thorough evaluation',
    icon: Sparkles,
    prefix: 'think hard',
    color: 'text-purple-600'
  },
  {
    id: 'think-harder',
    name: 'Think Harder',
    description: 'Deep analysis with alternatives',
    icon: Atom,
    prefix: 'think harder',
    color: 'text-indigo-600'
  },
  {
    id: 'ultrathink',
    name: 'Ultrathink',
    description: 'Maximum thinking budget',
    icon: Rocket,
    prefix: 'ultrathink',
    color: 'text-red-600'
  }
];
