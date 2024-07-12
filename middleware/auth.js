const jwt = require('jsonwebtoken');
const User = require('../models/users');

const authenticate = async (req, res, next) => {
    try {
        const token = req.header('Authorization');
        console.log(token);
        const decoded = jwt.verify(token, process.env.TOKEN_SECRET);
        console.log('userID >>>>', decoded.userId);
        
        const user = await User.findByPk(decoded.userId);
        if (!user) {
            throw new Error('User not found');
        }
        console.log(JSON.stringify(user));
        req.user = user;
        next();

    } catch (err) {
        console.log(err);
        return res.status(401).json({ success: false, message: 'Authentication failed' });
    }
}

module.exports = {
    authenticate
}
