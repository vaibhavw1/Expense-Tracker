const Expense = require('../models/expenses');
const User = require('../models/users');
const sequelize = require('../util/database');
const UserService = require('../services/userservices');
const S3service = require('../services/S3services');
const DownloadedFile = require('../models/downloadedFile');

const downloadexpense = async (req, res) => {
    try {
        
        const expenses = await UserService.getExpenses(req);
        
        console.log(expenses);
        
        const stringifiedExpenses = JSON.stringify(expenses);
        
        const userId = req.user.id;
        
        const filename = `Expenses${userId}/${new Date()}.txt`;
        const fileURl = await S3service.uploadToS3(stringifiedExpenses, filename);

        console.log(fileURl);
        const downloadedFile = await DownloadedFile.create({ fileURl, userId: req.user.id });
        res.status(200).json({ fileURl: downloadedFile.fileURl, success: true });
    } catch (err) {
        res.status(500).json({ fileURl: '', success: false, err: err.message });
    }
}

const getDownloadedFiles = async (req, res) => {
    try {
        const userId = req.user.id;
        const downloadedFiles = await DownloadedFile.findAll({
            where: { userId },
            order: [['downloadedAt', 'DESC']],
        });
        res.status(200).json({ downloadedFiles, success: true });
    } catch (err) {
        res.status(500).json({ success: false, err: err.message });
    }
}


const addexpense = async (req, res) => {
    const { expenseamount, description, category } = req.body;

    if (!expenseamount || !description || !category) {
        return res.status(400).json({ success: false, message: 'parameters missing' });
    }

    const t = await sequelize.transaction();

    try {
        
        // Create expense
        const expense = await Expense.create({ expenseamount, description, category, userId: req.user.id }, { transaction: t });
        
        // Update total expenses for the user
        const totalExpense = Number(req.user.totalExpenses) + Number(expenseamount);
        await User.update(
            { totalExpenses: totalExpense },
            { where: { id: req.user.id }, transaction: t }
        );
        
        // Commit transaction
        await t.commit();

        // Send response
        return res.status(200).json({ expense });
    } catch (err) {
        // rollback Transaction in case of error
        await t.rollback();
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
}

const getexpenses = async (req, res) => {
    const { page = 1, itemsPerPage = 'default' } = req.query;
    const offset = (page - 1) * itemsPerPage;
    const limit = itemsPerPage === 'default' ? null : parseInt(itemsPerPage);

    try {
        const queryOptions = {
            where: { userId: req.user.id },
        };

        if (limit) {
            queryOptions.offset = offset;
            queryOptions.limit = limit;
        }
        
        const { count, rows: expenses } = await Expense.findAndCountAll(queryOptions);
        res.status(200).json({ expenses, totalItems: count, success: true });
    
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

const deleteexpense = async (req, res) => {
    const expenseid = req.params.expenseid;
    if (!expenseid) {
        return res.status(400).json({ success: false, message: "Expense ID is missing" });
    }

    const t = await sequelize.transaction();

    try {
        // Find the expense to delete
        const expense = await Expense.findOne({ where: { id: expenseid, userId: req.user.id } });
        
        if (!expense) {
            return res.status(404).json({ success: false, message: "Expense not found or does not belong to the user" });
        }

        // Delete the expense
        await expense.destroy({ transaction: t });
        
        const totalExpense = Number(req.user.totalExpenses) - Number(expense.expenseamount);


        // Update totalExpenses for the user
        
        await User.update(
            { totalExpenses: totalExpense },
            { where: { id: req.user.id }, transaction: t }
        );

        // Commit transaction
        await t.commit();
        
        // Send response
        return res.status(200).json({ success: true, message: "Expense deleted successfully" });
    } catch (err) {
        // Rollback transaction in case of error
        await t.rollback();
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    addexpense,
    getexpenses,
    deleteexpense,
    downloadexpense,
    getDownloadedFiles

}
