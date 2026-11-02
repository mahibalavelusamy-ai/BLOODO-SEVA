export function requireRole(allowedRoles = ['admin', 'staff']) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    const role = req.user.role || 'viewer';
    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient privileges for this blood centre action',
        role,
        required: allowedRoles
      });
    }
    next();
  };
}

