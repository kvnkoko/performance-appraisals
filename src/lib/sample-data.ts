import type { Template, Employee } from '@/types';
import { generateId } from './utils';

export const sampleEmployees: Employee[] = [
  {
    id: generateId(),
    name: 'Sarah Johnson',
    email: 'sarah.johnson@company.com',
    role: 'CEO',
    hierarchy: 'executive',
    createdAt: new Date(2024, 0, 1).toISOString(),
  },
  {
    id: generateId(),
    name: 'Michael Chen',
    email: 'michael.chen@company.com',
    role: 'VP Engineering',
    hierarchy: 'leader',
    createdAt: new Date(2024, 0, 1).toISOString(),
  },
  {
    id: generateId(),
    name: 'Emily Rodriguez',
    email: 'emily.rodriguez@company.com',
    role: 'VP Marketing',
    hierarchy: 'leader',
    createdAt: new Date(2024, 0, 1).toISOString(),
  },
  {
    id: generateId(),
    name: 'David Kim',
    email: 'david.kim@company.com',
    role: 'Senior Engineer',
    hierarchy: 'member',
    createdAt: new Date(2024, 0, 1).toISOString(),
  },
  {
    id: generateId(),
    name: 'Jessica Martinez',
    email: 'jessica.martinez@company.com',
    role: 'Marketing Manager',
    hierarchy: 'member',
    createdAt: new Date(2024, 0, 1).toISOString(),
  },
  {
    id: generateId(),
    name: 'Robert Taylor',
    email: 'robert.taylor@company.com',
    role: 'Engineering Manager',
    hierarchy: 'leader',
    createdAt: new Date(2024, 0, 1).toISOString(),
  },
];

export const sampleTemplates: Template[] = [
  {
    id: generateId(),
    name: 'Executive Leadership Review',
    type: 'executives-to-leaders',
    version: 1,
    categories: [
      {
        id: generateId(),
        categoryName: 'Strategic Planning',
        items: [
          {
            id: generateId(),
            text: 'Strategic Vision and Planning',
            type: 'rating-1-5',
            weight: 20,
            required: true,
            order: 0,
          },
        ],
        order: 0,
      },
      {
        id: generateId(),
        categoryName: 'Leadership',
        items: [
          {
            id: generateId(),
            text: 'Team Leadership and Development',
            type: 'rating-1-5',
            weight: 20,
            required: true,
            order: 0,
          },
        ],
        order: 1,
      },
      {
        id: generateId(),
        categoryName: 'Communication',
        items: [
          {
            id: generateId(),
            text: 'Communication Effectiveness',
            type: 'rating-1-5',
            weight: 15,
            required: true,
            order: 0,
          },
        ],
        order: 2,
      },
      {
        id: generateId(),
        categoryName: 'Decision Making',
        items: [
          {
            id: generateId(),
            text: 'Decision Making',
            type: 'rating-1-5',
            weight: 15,
            required: true,
            order: 0,
          },
        ],
        order: 3,
      },
      {
        id: generateId(),
        categoryName: 'Overall',
        items: [
          {
            id: generateId(),
            text: 'Overall Performance',
            type: 'rating-1-5',
            weight: 30,
            required: true,
            order: 0,
          },
        ],
        order: 4,
      },
    ],
    createdAt: new Date(2024, 0, 1).toISOString(),
    updatedAt: new Date(2024, 0, 1).toISOString(),
  },
  {
    id: generateId(),
    name: 'Team Member Performance',
    type: 'leaders-to-members',
    version: 1,
    categories: [
      {
        id: generateId(),
        categoryName: 'Time Management',
        items: [
          {
            id: generateId(),
            text: 'Time Management',
            type: 'rating-1-5',
            weight: 15,
            required: true,
            order: 0,
          },
        ],
        order: 0,
      },
      {
        id: generateId(),
        categoryName: 'Communication',
        items: [
          {
            id: generateId(),
            text: 'Communication Skills',
            type: 'rating-1-5',
            weight: 20,
            required: true,
            order: 0,
          },
        ],
        order: 1,
      },
      {
        id: generateId(),
        categoryName: 'Problem Solving',
        items: [
          {
            id: generateId(),
            text: 'Problem Solving',
            type: 'rating-1-5',
            weight: 20,
            required: true,
            order: 0,
          },
        ],
        order: 2,
      },
      {
        id: generateId(),
        categoryName: 'Collaboration',
        items: [
          {
            id: generateId(),
            text: 'Collaboration',
            type: 'rating-1-5',
            weight: 20,
            required: true,
            order: 0,
          },
        ],
        order: 3,
      },
      {
        id: generateId(),
        categoryName: 'Quality',
        items: [
          {
            id: generateId(),
            text: 'Quality of Work',
            type: 'rating-1-5',
            weight: 25,
            required: true,
            order: 0,
          },
        ],
        order: 4,
      },
    ],
    createdAt: new Date(2024, 0, 1).toISOString(),
    updatedAt: new Date(2024, 0, 1).toISOString(),
  },
];
