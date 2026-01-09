import { Component } from 'preact'
import { reviewToTraining } from './lib/convert'

export default class ConvertLesson extends Component {
  constructor(props) {
    super(props)
    this.state = {
      gameReviewFile: null
    }
  }

  handleFileChange = async (event) => {
    const file = event.target.files[0]
    this.setState({ gameReviewFile: file })

    if (file) {
      try {
        const trainingFile = await reviewToTraining(file)
        console.log('Training file created:', trainingFile.name)
        this.setState({ trainingFile })

        // Automatically download the file
        const url = URL.createObjectURL(trainingFile)
        const a = document.createElement('a')
        a.href = url
        a.download = trainingFile.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('Failed to convert review:', error)
        // Handle error - maybe show a message to the user
      }
    }
  }

  render() {
    return (
      <div>
        <h1>Convert Lesson</h1>
        <p>This is the ConvertLesson page.</p>
        <div>
          <label htmlFor="gameReviewInput">Game Review File:</label>
          <input
            type="file"
            id="gameReviewInput"
            accept=".sgf,.txt"
            onChange={this.handleFileChange}
          />
          {this.state.gameReviewFile && (
            <p>Selected file: {this.state.gameReviewFile.name}</p>
          )}
          {this.state.trainingFile && (
            <p>Training file created: {this.state.trainingFile.name} ({this.state.trainingFile.size} bytes)</p>
          )}
        </div>
      </div>
    )
  }
}