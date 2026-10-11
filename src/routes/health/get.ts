import type { RequestHandler } from 'express';

export default function createHandler(): RequestHandler {
  return (req, res) => {
    res.json({ status: 'ok' });
  };
}
