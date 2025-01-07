const mongoose = require("mongoose");
const Admin = mongoose.model("Admin");

/**
 *  Get all documents of a Model with pagination
 *  @param {Object} req.params
 *  @returns {Object} Results with pagination
 */
exports.list = async (req, res) => {
  const page = req.query.page || 1;
  const limit = parseInt(req.query.items) || 10;
  const skip = (page - 1) * limit; // Adjusted calculation to make sure it's correct
  try {
    // Query the database for a list of all results
    const resultsPromise = Admin.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 }) // Sorting by `createdAt`
      .select("-password"); // Exclude password from response
    // Counting the total documents
    const countPromise = Admin.countDocuments();
    // Resolving both promises
    const [result, count] = await Promise.all([resultsPromise, countPromise]);
    // Calculating total pages
    const pages = Math.ceil(count / limit);
    // Pagination Object
    const pagination = { page, pages, count };

    if (count > 0) {
      return res.status(200).json({
        success: true,
        result,
        pagination,
        message: "Successfully found all documents",
      });
    } else {
      return res.status(203).json({
        success: false,
        result: [],
        pagination,
        message: "Collection is empty",
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: [],
      message: `Oops, there was an error: ${err.message}`,
    });
  }
};

/**
 * Get the profile of the current admin
 * @param {Object} req.body
 * @returns {Object} Admin profile details
 */
exports.profile = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(404).json({
        success: false,
        result: null,
        message: "Couldn't find admin profile.",
      });
    }

    const result = {
      _id: req.admin._id,
      enabled: req.admin.enabled,
      email: req.admin.email,
      name: req.admin.name,
      surname: req.admin.surname,
    };

    return res.status(200).json({
      success: true,
      result,
      message: "Successfully found profile",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: `Oops, there was an error: ${err.message}`,
    });
  }
};

/**
 * Get a single document by ID
 * @param {string} req.params.id
 * @returns {Object} Single admin document
 */
exports.read = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id).select("-password"); // Exclude password field
    if (!admin) {
      return res.status(404).json({
        success: false,
        result: null,
        message: `No document found by this id: ${req.params.id}`,
      });
    }
    return res.status(200).json({
      success: true,
      result: admin,
      message: `Found document with id: ${req.params.id}`,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: `Oops, there was an error: ${err.message}`,
    });
  }
};

/**
 * Creates a new admin document
 * @param {Object} req.body
 * @returns {Object} Newly created admin document
 */
exports.create = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "Email or password fields are missing.",
      });
    }

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "An account with this email already exists.",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "The password must be at least 8 characters long.",
      });
    }

    const newAdmin = new Admin(req.body);
    newAdmin.password = newAdmin.generateHash(password); // Hash password

    const savedAdmin = await newAdmin.save();
    return res.status(200).json({
      success: true,
      result: {
        _id: savedAdmin._id,
        enabled: savedAdmin.enabled,
        email: savedAdmin.email,
        name: savedAdmin.name,
        surname: savedAdmin.surname,
      },
      message: "Admin created successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Error creating admin: ${err.message}`,
    });
  }
};

/**
 * Updates an existing admin document
 * @param {Object} req.body
 * @param {string} req.params.id
 * @returns {Object} Updated admin document
 */
exports.update = async (req, res) => {
  try {
    const { email } = req.body;
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin && existingAdmin._id.toString() !== req.params.id) {
      return res.status(400).json({
        success: false,
        result: null,
        message: "An account with this email already exists.",
      });
    }

    const updates = {
      email: req.body.email,
      role: req.body.role,
    };

    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select("-password"); // Exclude password from response

    if (!updatedAdmin) {
      return res.status(404).json({
        success: false,
        result: null,
        message: `No document found by this id: ${req.params.id}`,
      });
    }

    return res.status(200).json({
      success: true,
      result: updatedAdmin,
      message: "Admin updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Error updating admin: ${err.message}`,
    });
  }
};

/**
 * Updates the password of an admin
 * @param {Object} req.body
 * @param {string} req.params.id
 * @returns {Object} Updated admin document with new password
 */
exports.updatePassword = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required." });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password needs to be at least 8 characters long.",
      });
    }

    const passwordHash = new Admin().generateHash(password); // Hash new password
    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.params.id,
      { password: passwordHash },
      { new: true }
    ).select("-password"); // Exclude password from response

    if (!updatedAdmin) {
      return res.status(404).json({
        success: false,
        message: `No admin found by id: ${req.params.id}`,
      });
    }

    return res.status(200).json({
      success: true,
      result: updatedAdmin,
      message: "Password updated successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: `Error updating password: ${err.message}`,
    });
  }
};

/**
 * Soft deletes an admin (marks as removed)
 * @param {string} req.params.id
 * @returns {Object} Status of deletion
 */
exports.delete = async (req, res) => {
  try {
    const result = await Admin.findByIdAndUpdate(
      req.params.id,
      { removed: true },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        result: null,
        message: `No admin found by this id: ${req.params.id}`,
      });
    }

    return res.status(200).json({
      success: true,
      result,
      message: "Admin marked as removed successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: null,
      message: `Error deleting admin: ${err.message}`,
    });
  }
};

/**
 * Search for admins by fields and value
 * @param {Object} req.query
 * @returns {Array} Matching admins
 */
exports.search = async (req, res) => {
  try {
    const searchQuery = req.query.q;
    if (!searchQuery) {
      return res.status(202).json({
        success: false,
        result: [],
        message: "No search query provided.",
      });
    }

    const fieldsArray = req.query.fields.split(",");
    const fields = { $or: fieldsArray.map(field => ({ [field]: { $regex: searchQuery, $options: "i" } })) };

    const admins = await Admin.find(fields).limit(10);
    if (admins.length > 0) {
      return res.status(200).json({
        success: true,
        result: admins,
        message: "Admins found successfully",
      });
    } else {
      return res.status(202).json({
        success: false,
        result: [],
        message: "No admins found.",
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      result: [],
      message: `Error searching admins: ${err.message}`,
    });
  }
};
