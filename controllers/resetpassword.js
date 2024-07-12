const uuid = require('uuid');
const brevo = require('@getbrevo/brevo'); 
const bcrypt = require('bcrypt');

const User = require('../models/users');
const Forgotpassword = require('../models/forgotpassword');


const forgotpassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ where: { email }});

        if (user) {
            const id = uuid.v4();
            await user.createForgotpassword({ id, active: true });

            
            const brevoApiKey = process.env.BREVO_API_KEY;

            // Initialize the TransactionalEmailsApi with the API key
            const apiInstance = new brevo.TransactionalEmailsApi(); 
            apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, brevoApiKey); 

            
            const sendSmtpEmail = new brevo.SendSmtpEmail({ 
                to: [{ email }],
                sender: { name: 'vaibhav wakde', email: 'vaibhavwakde266@gmail.com' },
                subject: 'Reset Password Request',
                htmlContent: `<p>Click the link below to reset your password.</p><a href="http://localhost:5000/password/resetpassword/${id}">Reset password</a>`
            });

            
            const data = await apiInstance.sendTransacEmail(sendSmtpEmail); 
            console.log('Email sent successfully:', data);
            return res.status(200).json({ message: 'Link to reset password sent to your email', success: true });
        } else {
            throw new Error('User does not exist');
        }
    } catch (err) {
        console.error('Error sending email:', err); 
        return res.status(500).json({ message: 'Failed to send email', success: false });
    }
}


const resetpassword = (req, res) => {
    const id = req.params.id;
    Forgotpassword.findOne({ where : { id }})
    .then(forgotpasswordrequest => {
        if (forgotpasswordrequest) {
            forgotpasswordrequest.update({ active: false });
            
            res.status(200).send(`
                <html>
                    <form action="/password/updatepassword/${id}" method="get">
                        <label for="newpassword">Enter New password</label>
                        <input name="newpassword" type="password" required></input>
                        <button>Reset Password</button>
                    </form>
                </html>`
            );
        }
    })
    .catch(err => {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    });
}


const updatepassword = (req, res) => {
    try {
        const { newpassword } = req.query;
        const { resetpasswordid } = req.params;

        Forgotpassword.findOne({ where : { id: resetpasswordid }})
        .then(resetpasswordrequest => {
            User.findOne({ where: { id: resetpasswordrequest.userId }})
            .then(user => {
                if (user) {
                    // Encrypt the new password
                    const saltRounds = 10;
                    bcrypt.genSalt(saltRounds, function(err, salt) {
                        if (err) {
                            console.error(err);
                            throw new Error(err);
                        }
                        bcrypt.hash(newpassword, salt, function(err, hash) {
                            if (err) {
                                console.error(err);
                                throw new Error(err);
                            }
                            user.update({ password: hash })
                            .then(() => {
                                res.status(201).json({ message: 'Successfully updated the new password' });
                            })
                            .catch(error => {
                                console.error(error);
                                throw new Error(error);
                            });
                        });
                    });
                } else {
                    return res.status(404).json({ error: 'No user exists', success: false });
                }
            });
        });
    } catch (error) {
        return res.status(403).json({ error: error.message, success: false });
    }
}

module.exports = {
    forgotpassword,
    updatepassword,
    resetpassword
}
