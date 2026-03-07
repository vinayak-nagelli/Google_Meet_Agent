import subprocess
import os
import shutil

# GitHub repository to test
REPO_URL = "https://github.com/vinayak-nagelli/my-first-project.git"

# Folder where repo will be cloned
CLONE_DIR = "cloned_repo"


def clone_repository():
    """Clone the GitHub repository"""

    # Remove old clone if it exists
    if os.path.exists(CLONE_DIR):
        shutil.rmtree(CLONE_DIR)

    print("Cloning repository...")

    result = subprocess.run(
        ["git", "clone", REPO_URL, CLONE_DIR],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        print("❌ Clone failed")
        print(result.stderr)
        return False

    print("✅ Repository cloned successfully")
    return True


def install_dependencies():
    """Install repo dependencies if requirements.txt exists"""

    req_file = os.path.join(CLONE_DIR, "requirements.txt")

    if os.path.exists(req_file):
        print("Installing dependencies...")

        subprocess.run(
            ["pip", "install", "-r", "requirements.txt"],
            cwd=CLONE_DIR
        )
    else:
        print("No requirements.txt found, skipping install")


def run_tests():
    """Run pytest inside cloned repo"""

    print("Running pytest...")

    result = subprocess.run(
        ["python", "-m", "pytest", "-v"],
        cwd=CLONE_DIR,
        capture_output=True,
        text=True
    )

    print(result.stdout)

    if result.returncode == 0:
        print("✅ All tests passed")
        return True
    else:
        print("❌ Tests failed")
        print(result.stderr)
        return False


if __name__ == "__main__":

    # Step 1: Clone repository
    if not clone_repository():
        exit()

    # Step 2: Install dependencies
    install_dependencies()

    # Step 3: Run tests
    run_tests()