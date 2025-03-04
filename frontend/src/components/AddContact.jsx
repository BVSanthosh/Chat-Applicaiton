import { Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { axiosInstance } from "../lib/axios";

const AddContact = ({ isOpen, setIsOpen }) => {
  const [newContact, setNewContact] = useState("");
  const [suggestedUsers, setSuggestedUsers]= useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newContact.trim().length === 0) {
      return;
    }

    try {
        const res = await axiosInstance.get("/users/suggested-users", {
          params: {
              username: newContact,
          },
        });

        setSuggestedUsers(res.data);

    } catch (error) {
        console.log("Error in getSuggestedUsers: " + error);
    }
  }

  return (
    <div className={` modal ${isOpen ? "modal-open" : ""}`}>
      <div className="modal-box">
        <h3 className="font-bold text-lg">New Contact</h3>
        <div className="flex flex-col items-center justify-center mt-8 p-3">
          <div className="flex items-center justify-center gap-2">
            <input
              className="input input-bordered px-10"
              placeholder="Search contact..."
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
            />
            <button 
              className="flex items-center btn transition-colors"
              onClick={handleSubmit}
            >
              <Search className="size-5"/>
            </button>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 mt-6">
              {suggestedUsers.map((user) => (
                <div key={user._id} className="card card-bordered border-base-300 shadow-xl px-10">
                  <div className="card-body">
                    <div className="flex items-center justify-center gap-3">
                      <span className="text-semibold">{user.fullName}</span>
                      <Link to={`/profile/${user._id}`} className="btn btn-sm transition-colors">View Profile</Link>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="modal-action">
          <button onClick={() => setIsOpen(false)} className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddContact;