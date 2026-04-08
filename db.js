import mongoose from 'mongoose';

// Connect to MongoDB
export const connectDB = async (mongoUri) => {
    try {
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB Connected Successfully');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

// Schema to save WhatsApp Auth Session so it survives server restarts
const AuthStateSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    data: { type: String, required: true }
});
export const AuthState = mongoose.model('AuthState', AuthStateSchema);

// Schema for Vendor Inventory
const InventorySchema = new mongoose.Schema({
    vendorId: { type: String, required: true }, // To separate different vendors
    itemName: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    description: { type: String },
    addedAt: { type: Date, default: Date.now }
});
export const Inventory = mongoose.model('Inventory', InventorySchema);
